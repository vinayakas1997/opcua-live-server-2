import { useState } from "react";
import LanguageSwitcher from "../LanguageSwitcher";
import type { Language } from "@shared/schema";

export default function LanguageSwitcherExample() {
  return (
    <div className="p-4">
      <LanguageSwitcher />
    </div>
  );
}