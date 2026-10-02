import type { ComponentProps } from "react";
import { FormTextField } from "@/src/components/forms";

export function AssetSearchField(props: Omit<ComponentProps<typeof FormTextField>, "label">) {
  return <FormTextField label="Search asset" placeholder="Name, symbol, or ticker" returnKeyType="search" {...props} />;
}
