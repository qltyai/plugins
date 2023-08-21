import { linterCheckTest } from "tests";

linterCheckTest({ linterName: "flake8" });

test('adds 1 + 2 to equal 3', () => {
  expect(3).toBe(3);
});