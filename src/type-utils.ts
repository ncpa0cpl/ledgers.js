import type { CopiesList } from "./entity-containers/copy-list";
import type { Entity } from "./entity-containers/entity";
import type { EntityList } from "./entity-containers/entity-list";
import type { Ledger } from "./ledger/ledger";
import type { Reference } from "./types";

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
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
  N = [T] extends [never] ? true : false,
> = true extends N ? [] : Push<TuplifyUnion<Exclude<T, L>>, L>;

export type IsUnion<T> = TuplifyUnion<T> extends { length: 1 } ? false : true;

export type Serial<T extends object> = {
  [K in keyof T as T[K] extends Function ? never : K]: T[K];
};

export type DeepPartial<T> = T extends object
  ? {
      [K in keyof T]?: IsUnion<T[K]> extends true
        ? T[K]
        : T[K] extends Reference<any>
        ? T[K]
        : DeepPartial<T[K]>;
    }
  : T;

type IfEquals<X, Y, A, B> = (<T>() => T extends X ? 1 : 2) extends <
  T,
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

type EntityName<E extends Entity<any>> = E extends Entity<infer N>
  ? N["name"]
  : never;

type EntityListName<E extends EntityList<any>> = E extends EntityList<infer N>
  ? N["name"]
  : never;

type CopiesListName<E extends CopiesList<any>> = E extends CopiesList<
  any,
  infer Name
>
  ? Name
  : never;

type EntitiesSnapshot<L extends Ledger> = {
  [K in keyof L as L[K] extends Entity<any>
    ? EntityName<L[K]>
    : never]: L[K] extends Entity<infer E> ? E : never;
};

type ListEntitiesSnapshot<L extends Ledger> = {
  [K in keyof L as L[K] extends EntityList<any>
    ? EntityListName<L[K]>
    : never]: L[K] extends EntityList<infer E> ? E[] : never;
};

type CopiesSnapshot<L extends Ledger> = {
  [K in keyof L as L[K] extends CopiesList<any>
    ? CopiesListName<L[K]>
    : never]: L[K] extends CopiesList<infer E> ? E[] : never;
};

export type SnapshotOf<L extends Ledger> = {
  entities: EntitiesSnapshot<L>;
  listEntities: ListEntitiesSnapshot<L>;
  copies: CopiesSnapshot<L>;
};

export type NameOf<T> = T extends Entity<any>
  ? EntityName<T>
  : T extends EntityList<any>
  ? EntityListName<T>
  : T extends CopiesList<any>
  ? CopiesListName<T>
  : never;

export type AsString<T> = T extends string ? T : never;

export type LedgerProperties<L extends Ledger> = keyof {
  [K in keyof L as NameOf<L[K]>]: string;
};

type Values<T> = T[keyof T];

type Extract<T> = T extends Entity<infer U>
  ? U
  : T extends EntityList<infer U>
  ? U
  : T extends CopiesList<infer U>
  ? U
  : never;

export type EntityOfName<L extends Ledger, N extends string> = Extract<
  Values<{
    [K in keyof L as N extends NameOf<L[K]> ? K : never]: L[K];
  }>
>;
