import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class ApproveWithdrawalDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

export class RejectWithdrawalDto {
  /**
   * Required, not optional: a rejection the user cannot understand is worse than
   * no rejection, and §17 says the reason must be stored.
   */
  @IsString()
  @IsNotEmpty({ message: 'A rejection reason is required' })
  @MaxLength(500)
  reason!: string;
}

/**
 * Marks a payout as sent. The hash is the only thing accepted — the amount,
 * recipient, token and success are all read back from the chain before the
 * request is allowed to reach COMPLETED (§22).
 */
export class CompleteWithdrawalDto {
  @IsString()
  @Matches(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/, {
    message: 'transactionSignature must be a valid Solana signature',
  })
  transactionSignature!: string;
}

export class FailWithdrawalDto {
  @IsString()
  @IsNotEmpty({ message: 'A reason is required' })
  @MaxLength(500)
  reason!: string;
}
