// Custom error classes for UCL parser
export class UCLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UCLError";
  }
}

export class UCLSyntaxError extends UCLError {
  constructor(message: string) {
    super(message);
    this.name = "UCLSyntaxError";
  }
}

export class UCLReferenceError extends UCLError {
  constructor(message: string) {
    super(message);
    this.name = "UCLReferenceError";
  }
}

export class UCLTypeError extends UCLError {
  constructor(message: string) {
    super(message);
    this.name = "UCLTypeError";
  }
}