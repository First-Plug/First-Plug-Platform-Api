export class OrderNumberGenerator {
  private current: number;

  constructor(initial: number) {
    this.current = initial;
  }

  getNext(): number {
    this.current += 1;
    return this.current;
  }

  getCurrent(): number {
    return this.current;
  }
}
