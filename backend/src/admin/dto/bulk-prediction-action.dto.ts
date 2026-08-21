import { ArrayNotEmpty, IsArray, IsIn, IsString } from 'class-validator';

export const BULK_PREDICTION_ACTIONS = [
  'open',
  'close',
  'cancel',
  'feature',
  'unfeature',
] as const;
export type BulkPredictionAction = (typeof BULK_PREDICTION_ACTIONS)[number];

export class BulkPredictionActionDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];

  @IsIn(BULK_PREDICTION_ACTIONS)
  action!: BulkPredictionAction;
}
