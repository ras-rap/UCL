// Core types for UCL parser
export type UCLValue = string | number | boolean | null | UCLArray | UCLObject;
export type UCLArray = UCLValue[];
export interface UCLObject {
  [key: string]: UCLValue;
}