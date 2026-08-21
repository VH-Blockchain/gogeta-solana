import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePurchaseDto {
  /** The wallet that will send the payment. */
  @IsString()
  @Matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, {
    message: 'walletAddress must be a valid Solana address',
  })
  walletAddress!: string;

  /**
   * A decimal USDC amount as a *string* — a JSON number cannot represent token
   * amounts exactly, and the value is parsed with parseUnits rather than
   * Number() (§17). Bounds are enforced against the admin settings in the
   * service, not here, since they are configurable at runtime.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'usdcAmount must be a positive decimal number',
  })
  usdcAmount!: string;
}
