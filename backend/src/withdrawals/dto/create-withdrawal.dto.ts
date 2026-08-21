import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Note what is absent: no payout amount, no exchange rate, no withdrawable
 * balance. Those are all derived server-side (§12, §25) — the client only says
 * how many points it wants to cash out and where to send the money.
 */
export class CreateWithdrawalDto {
  /**
   * Points to withdraw. The real floor is the admin-configured
   * `economy.minWithdrawalPoints`, checked in the service; `Min(1)` here only
   * rejects nonsense before it gets that far.
   */
  @IsInt()
  @Min(1)
  points!: number;

  @IsString()
  @Matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, {
    message: 'walletAddress must be a valid Solana address',
  })
  walletAddress!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  userNote?: string;
}
