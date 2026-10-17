"use client";

import { ColorPickerPopover, ColorSwatch } from "@/components/ui/color-picker";
import { normalizeHex } from "@/lib/admin/format";

// Neutral grounds that sit well behind a fixed page, the default first.
const SWATCHES = ["#D8D2C8", "#EDEAE4", "#F5F5F5", "#E5E5E5", "#A3A3A3", "#404040", "#171717", "#FFFFFF"];

/** Letterbox colour as `#RRGGBB`: the FF colour picker behind a tile + hex trigger. */
export function LetterboxPicker({
  value,
  onChange,
  open,
  onOpenChange,
}: {
  value: string;
  onChange: (hex: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <ColorPickerPopover
      value={value}
      format="hex"
      swatches={SWATCHES}
      open={open}
      onOpenChange={onOpenChange}
      onValueChange={(_, parsed) => {
        const hex = normalizeHex(parsed.hex);
        if (hex) onChange(hex);
      }}
      triggerClassName="w-full"
    />
  );
}

/** Inside a dialog: a swatch row plus a hex field. (The popover picker
 *  portals under a modal dialog's layer, so it is used on the page only.) */
export function LetterboxSwatches({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Letterbox-Farbe" className="flex flex-wrap gap-2.5 py-1 pl-1">
      {SWATCHES.map((color) => (
        <ColorSwatch
          key={color}
          color={color}
          size={24}
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          selected={value === color}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}
