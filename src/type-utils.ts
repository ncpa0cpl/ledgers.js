type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

type LastOf<T> = UnionToIntersection<
  T extends any ? () => T : never
> extends () => infer R
  ? R
  : never;

type Push<T extends any[], V> = [...T, V];

export type TuplifyUnion<
  T,
  L = LastOf<T>,
  N = [T] extends [never] ? true : false
> = true extends N ? [] : Push<TuplifyUnion<Exclude<T, L>>, L>;

export type IsUnion<T> = TuplifyUnion<T> extends { length: 1 } ? false : true;

export type Serial<T extends object> = {
  [K in keyof T as T[K] extends Function ? never : K]: T[K];
};

export type DeepPartial<T> = T extends object
  ? {
      [K in keyof T]?: IsUnion<T[K]> extends true ? T[K] : DeepPartial<T[K]>;
    }
  : T;

type IfEquals<X, Y, A, B> = (<T>() => T extends X ? 1 : 2) extends <
  T
>() => T extends Y ? 1 : 2
  ? A
  : B;

export type WritableKeysOf<T> = {
  [P in keyof T]: IfEquals<
    { [Q in P]: T[P] },
    { -readonly [Q in P]: T[P] },
    P,
    never
  >;
}[keyof T];

export type ReadonlyKeys<T> = Exclude<keyof T, WritableKeysOf<T>>;
