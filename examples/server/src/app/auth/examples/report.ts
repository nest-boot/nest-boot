/** Minimal business resource for the authorization recipe, not an auth entity. */
export class Report {
  constructor(
    public readonly id: string,
    public readonly workspaceId: string,
    public readonly archived = false,
  ) {}
}
