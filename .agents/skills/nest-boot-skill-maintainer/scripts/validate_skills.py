#!/usr/bin/env python3
"""Validate every skill, eval file, reference, and generated README entry."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Iterable

from update_readme import (
    collect_skills,
    read_frontmatter,
    render_table,
    replace_generated_table,
)


NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MARKDOWN_LINK_PATTERN = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
ALLOWED_FRONTMATTER_KEYS = {
    "name",
    "description",
    "license",
    "allowed-tools",
    "metadata",
    "compatibility",
}
EVAL_FIELDS = {"id", "prompt", "expected_output", "files", "expectations"}


def add_markdown_issues(
    markdown_file: Path,
    skill_dir: Path,
    errors: list[str],
    warnings: list[str],
) -> None:
    content = markdown_file.read_text(encoding="utf-8")
    lines = content.splitlines()

    if content.count("```") % 2:
        errors.append(f"{markdown_file}: unbalanced fenced code blocks")
    for line_number, line in enumerate(lines, start=1):
        if line.rstrip(" \t") != line:
            errors.append(f"{markdown_file}:{line_number}: trailing whitespace")

    for raw_link in MARKDOWN_LINK_PATTERN.findall(content):
        link = raw_link.split(maxsplit=1)[0].strip("<>")
        if (
            not link
            or link.startswith("#")
            or re.match(r"^[a-z][a-z0-9+.-]*:", link, re.IGNORECASE)
        ):
            continue
        target = link.split("#", 1)[0]
        if target and not (markdown_file.parent / target).exists():
            errors.append(f"{markdown_file}: broken relative link {raw_link!r}")

    if markdown_file.name == "SKILL.md" and len(lines) > 500:
        warnings.append(
            f"{markdown_file}: {len(lines)} lines; consider progressive disclosure"
        )
    if markdown_file.parent.name == "references" and len(lines) > 300:
        if not re.search(r"^## (目录|Contents|Table of Contents)\s*$", content, re.M):
            warnings.append(f"{markdown_file}: >300 lines without a contents section")


def validate_evals(skill_dir: Path, skill_name: str, errors: list[str]) -> int:
    eval_path = skill_dir / "evals" / "evals.json"
    if not eval_path.is_file():
        errors.append(f"{eval_path}: missing eval file")
        return 0

    try:
        data = json.loads(eval_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        errors.append(f"{eval_path}: invalid JSON: {error}")
        return 0

    if not isinstance(data, dict):
        errors.append(f"{eval_path}: top-level value must be an object")
        return 0
    if data.get("skill_name") != skill_name:
        errors.append(f"{eval_path}: skill_name must be {skill_name!r}")

    evals = data.get("evals")
    if not isinstance(evals, list) or len(evals) < 2:
        errors.append(f"{eval_path}: define at least two realistic evals")
        return 0

    ids: list[int] = []
    for index, item in enumerate(evals):
        label = f"{eval_path}: eval[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{label} must be an object")
            continue
        missing = EVAL_FIELDS - item.keys()
        unexpected = item.keys() - EVAL_FIELDS
        if missing:
            errors.append(f"{label} missing fields: {', '.join(sorted(missing))}")
        if unexpected:
            errors.append(
                f"{label} has unexpected fields: {', '.join(sorted(unexpected))}"
            )

        eval_id = item.get("id")
        if not isinstance(eval_id, int):
            errors.append(f"{label}.id must be an integer")
        else:
            ids.append(eval_id)
        for field in ("prompt", "expected_output"):
            value = item.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{label}.{field} must be a non-empty string")

        expectations = item.get("expectations")
        if not isinstance(expectations, list) or not expectations:
            errors.append(f"{label}.expectations must be a non-empty list")
        elif not all(isinstance(value, str) and value.strip() for value in expectations):
            errors.append(f"{label}.expectations must contain non-empty strings")

        files = item.get("files")
        if not isinstance(files, list):
            errors.append(f"{label}.files must be a list")
        else:
            for file_name in files:
                if not isinstance(file_name, str) or not (skill_dir / file_name).is_file():
                    errors.append(f"{label}: missing input file {file_name!r}")

    if len(ids) != len(set(ids)):
        errors.append(f"{eval_path}: eval IDs must be unique")
    return len(evals)


def iter_markdown(skill_dir: Path) -> Iterable[Path]:
    yield skill_dir / "SKILL.md"
    references = skill_dir / "references"
    if references.is_dir():
        yield from sorted(references.glob("*.md"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    args = parser.parse_args()
    repo = args.repo.resolve()

    errors: list[str] = []
    warnings: list[str] = []
    eval_count = 0

    try:
        skills = collect_skills(repo)
    except ValueError as error:
        print(f"[ERROR] {error}")
        return 1

    for skill in skills:
        skill_md = skill.directory / "SKILL.md"
        frontmatter = read_frontmatter(skill_md)
        unexpected = set(frontmatter) - ALLOWED_FRONTMATTER_KEYS
        if unexpected:
            errors.append(
                f"{skill_md}: unexpected frontmatter keys: {', '.join(sorted(unexpected))}"
            )
        if not NAME_PATTERN.fullmatch(skill.name) or len(skill.name) > 64:
            errors.append(f"{skill_md}: invalid skill name {skill.name!r}")
        if len(skill.description) > 1024 or any(char in skill.description for char in "<>"):
            errors.append(f"{skill_md}: invalid description")

        references = sorted((skill.directory / "references").glob("*.md"))
        skill_text = skill_md.read_text(encoding="utf-8")
        for reference in references:
            relative = reference.relative_to(skill.directory).as_posix()
            if relative not in skill_text:
                errors.append(f"{skill_md}: reference is not linked: {relative}")

        for markdown_file in iter_markdown(skill.directory):
            add_markdown_issues(markdown_file, skill.directory, errors, warnings)
        eval_count += validate_evals(skill.directory, skill.name, errors)

    readme_path = repo / "README.md"
    if not readme_path.is_file():
        errors.append(f"{readme_path}: README.md not found")
    else:
        try:
            original = readme_path.read_text(encoding="utf-8")
            expected = replace_generated_table(original, render_table(skills))
            if expected != original:
                errors.append("README.md skill table is out of date")
        except ValueError as error:
            errors.append(str(error))

    for warning in warnings:
        print(f"[WARN] {warning}")
    for error in errors:
        print(f"[ERROR] {error}")

    if errors:
        print(
            f"Validation failed: {len(skills)} skills, {eval_count} evals, "
            f"{len(errors)} errors, {len(warnings)} warnings"
        )
        return 1

    print(
        f"Validation passed: {len(skills)} skills, {eval_count} evals, "
        f"{len(warnings)} warnings"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
