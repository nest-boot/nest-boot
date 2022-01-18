import { Transform } from "class-transformer";

import { JobType } from "../enums/job-type.enum";

export class JobQueriesDto {
  @Transform((value) => {
    const transformedValue = Number(value);
    if (Number.isNaN(transformedValue)) {
      return 1;
    }
    return transformedValue;
  })
  page: number;

  type: JobType;
}
