export function must<T>(x: T | undefined | null): T {
	if (x === undefined || x === null)
		throw new Error('Expected value to be defined');
	return x;
}
