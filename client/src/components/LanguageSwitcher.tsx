import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "jp" : "en");
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className="gap-2"
      onClick={toggleLanguage}
      data-testid="button-language-switcher"
    >
      <Globe className="h-4 w-4" />
      {language.toUpperCase()}
    </Button>
  );
}