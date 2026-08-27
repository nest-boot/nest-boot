#!/usr/bin/env python3
"""Regenerate the README skill table from SKILL.md frontmatter."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    import yaml
except ModuleNotFoundError as error:
    raise SystemExit("PyYAML is required: python3 -m pip install PyYAML") from error


START_MARKER = "<!-- BEGIN GENERATED SKILLS -->"
END_MARKER = "<!-- END GENERATED SKILLS -->"
FRONTMATTER_PATTERN = re.compile(r"\A---\n(.*?)\n---(?:\n|\Z)", re.DOTALL)


@dataclass(frozen=True)
class SkillMetadata:
    name: str
    description: str
    directory: Path


def read_frontmatter(skill_md: Path) -> dict[str, object]:
    content = skill_md.read_text(encoding="utf-8")
    match = FRONTMATTER_PATTERN.match(content)
    if match is None:
        raise ValueError(f"{skill_md}: invalid or missing YAML frontmatter")

    data = yaml.safe_load(match.group(1))
    if not isinstance(data, dict):
        raise ValueError(f"{skill_md}: frontmatter must be a mapping")
    return data


def collect_skills(repo: Path) -> list[SkillMetadata]:
    skills_root = repo / "skills"
    if not skills_root.is_dir():
        raise ValueError(f"{skills_root}: skills directory not found")

    result: list[SkillMetadata] = []
    for directory in sorted(path for path in skills_root.iterdir() if path.is_dir()):
        skill_md = directory / "SKILL.md"
        if not skill_md.is_file():
            raise ValueError(f"{directory}: SKILL.md not found")

        frontmatter = read_frontmatter(skill_md)
        name = frontmatter.get("name")
        description = frontmatter.get("description")
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"{skill_md}: name must be a non-empty string")
        if name != directory.name:
            raise ValueError(
                f"{skill_md}: name {name!r} does not match directory {directory.name!r}"
            )
        if not isinstance(description, str) or not description.strip():
            raise ValueError(f"{skill_md}: description must be a non-empty string")

        result.append(
            SkillMetadata(
                name=name,
                description=description.strip(),
                directory=directory,
            )
        )

    names = [skill.name for skill in result]
    if len(names) != len(set(names)):
        raise ValueError("duplicate skill names found")
    return result


def escape_cell(value: str) -> str:
    return " ".join(value.split()).replace("|", r"\|")


def render_table(skills: list[SkillMetadata]) -> str:
    lines = [
        START_MARKER,
        "| Skill | 描述 |",
        "| --- | --- |",
    ]
    for skill in skills:
        link = f"skills/{skill.name}/"
        lines.append(
            f"| [{skill.name}]({link}) | {escape_cell(skill.description)} |"
        )
    lines.append(END_MARKER)
    return "\n".join(lines)


def replace_generated_table(readme: str, table: str) -> str:
    pattern = re.compile(
        rf"{re.escape(START_MARKER)}.*?{re.escape(END_MARKER)}", re.DOTALL
    )
    if pattern.search(readme) is None:
        raise ValueError(
            f"README.md must contain {START_MARKER!r} and {END_MARKER!r}"
        )
    return pattern.sub(lambda _match: table, readme, count=1)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail when README.md does not match generated content.",
    )
    args = parser.parse_args()

    repo = args.repo.resolve()
    readme_path = repo / "README.md"
    if not readme_path.is_file():
        raise SystemExit(f"{readme_path}: README.md not found")

    try:
        generated = render_table(collect_skills(repo))
        original = readme_path.read_text(encoding="utf-8")
        updated = replace_generated_table(original, generated)
    except ValueError as error:
        raise SystemExit(str(error)) from error

    if args.check:
        if updated != original:
            print("README.md skill table is out of date", file=sys.stderr)
            return 1
        print("README.md skill table is up to date")
        return 0

    if updated == original:
        print("README.md skill table is already up to date")
        return 0

    readme_path.write_text(updated, encoding="utf-8")
    print(f"Updated {readme_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
