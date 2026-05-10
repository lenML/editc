export class MyService {
  hello() {
    console.log("1");
  }
}

/** 1 */
const config = {
  port: 1234,
};

function fib(n: number) {
  let fib = [0, 1]; // Step 1: Initialize with first two terms

  for (let i = 2; i < n; i++) {
    // Step 2: Sum the two preceding numbers
    fib[i] = fib[i - 1] + fib[i - 2];
  }

  return fib;
}
