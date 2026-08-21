import { IsString, Matches } from 'class-validator';

/**
 * Note what is absent: no amount, no points, no wallet, no status. The hash is
 * the only thing the client may contribute — everything else is read from the
 * chain (§8).
 */
export class ConfirmPurchaseDto {
  @IsString()
  @Matches(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/, {
    message: 'transactionSignature must be a valid Solana signature',
  })
  transactionSignature!: string;
}
