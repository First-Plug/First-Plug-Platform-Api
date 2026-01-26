export class PublicQuoteResponseDto {
  message: string;
  quoteNumber: string;
  createdAt: Date;

  constructor(quoteNumber: string) {
    this.message = 'Quote creada exitosamente';
    this.quoteNumber = quoteNumber;
    this.createdAt = new Date();
  }
}

