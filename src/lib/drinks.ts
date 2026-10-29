// Drink-name helpers. Drink-themed achievements and celebrations follow the
// drink name, not the die number, because special menus move drinks around
// (e.g. Barrel-Aged Malört is white 1 on the Halloween menu).

/** True for any Malört variant: "Malort", "Barrel-Aged Malört", "MALÖRT". */
export function isMalort(drinkName: string | null | undefined): boolean {
  if (!drinkName) return false;
  return drinkName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .includes("malort");
}

/** PostgREST `.or()` filter matching the same names as isMalort on white_drink_name. */
export const WHITE_MALORT_FILTER = "white_drink_name.ilike.%malort%,white_drink_name.ilike.%malört%";
