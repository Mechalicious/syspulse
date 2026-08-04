import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AppSettings } from "@/types";
import type { ReactNode } from "react";
import {
  Globe2,
  MonitorCog,
  MoonStar,
  Rocket,
  SunMedium,
  Thermometer,
  UploadCloud,
  Wind,
} from "lucide-react";

interface SettingsPanelProps {
  settings: AppSettings;
  language: "fr" | "en";
  onChange: (next: AppSettings) => void;
  onCheckUpdate: () => Promise<void>;
  saving: boolean;
}

function text(language: "fr" | "en") {
  if (language === "en") {
    return {
      title: "Settings",
      startup: "Startup",
      autoRun: "Auto run on boot",
      hideOnBoot: "Hide on system tray when auto run on boot",
      minimizeOnClose: "Minimize app to system tray at close",
      floating: "Displays a floating system information window",
      languageLabel: "Language",
      tempLabel: "Temperature display",
      service: "Service & Software",
      update: "Check for updates",
      theme: "Theme",
      dark: "Dark",
      light: "Light",
      yes: "Enabled",
      no: "Disabled",
      celsius: "Celsius",
      fahrenheit: "Fahrenheit",
      startupHint: "Keep SysPulse available as soon as your session starts.",
      languageHint: "Choose the display language for labels and navigation.",
      temperatureHint: "Select how temperatures are shown across all cards.",
      themeHint: "Switch between light and dark visual style.",
      softwareHint: "Get the latest service and software package.",
    };
  }

  return {
    title: "Parametres",
    startup: "Demarrage",
    autoRun: "Lancer automatiquement au demarrage",
    hideOnBoot: "Masquer dans la zone de notification au lancement automatique",
    minimizeOnClose: "Reduire dans la zone de notification a la fermeture",
    floating: "Afficher une fenetre flottante d'informations systeme",
    languageLabel: "Langue",
    tempLabel: "Affichage temperature",
    service: "Service & Software",
    update: "Verifier les mises a jour",
    theme: "Theme",
    dark: "Sombre",
    light: "Clair",
    yes: "Active",
    no: "Desactive",
    celsius: "Celsius",
    fahrenheit: "Fahrenheit",
    startupHint: "Gardez SysPulse disponible des l'ouverture de session.",
    languageHint: "Choisissez la langue des libelles et de la navigation.",
    temperatureHint: "Definissez l'unite de temperature sur toutes les cartes.",
    themeHint: "Basculez entre les themes clair et sombre.",
    softwareHint: "Recuperez la derniere version du service et du logiciel.",
  };
}

function RadioRow(props: {
  label: string;
  hint: string;
  icon: ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
  yesLabel: string;
  noLabel: string;
}) {
  const { label, hint, icon, value, onChange, yesLabel, noLabel } = props;
  return (
    <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-muted p-2 text-muted-foreground">{icon}</div>
        <div>
          <p className="text-sm font-semibold leading-tight">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="inline-flex rounded-lg border border-border/80 bg-muted/40 p-1">
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            value ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => onChange(true)}
        >
          {yesLabel}
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            !value ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => onChange(false)}
        >
          {noLabel}
        </button>
      </div>
    </div>
  );
}

function ToggleRow(props: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { label, checked, onCheckedChange } = props;
  return (
    <label className="flex items-center justify-between rounded-xl border border-border/80 bg-card/60 px-4 py-3 text-sm shadow-sm">
      <span className="pr-3">{label}</span>
      <span className="relative inline-flex">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        <span className="h-6 w-11 rounded-full border border-border bg-muted transition peer-checked:bg-primary" />
        <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-background shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function SegmentedButton(props: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  const { active, children, onClick } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
        active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function SettingsPanel({ settings, language, onChange, onCheckUpdate, saving }: SettingsPanelProps) {
  const t = text(language);

  return (
    <div>
      <Card className="overflow-hidden border-border/80 bg-card/40">
        <CardContent className="space-y-5 p-5">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{t.startup}</h3>
            <div className="grid gap-3">
              <RadioRow
                label={t.autoRun}
                hint={t.startupHint}
                icon={<Rocket className="h-4 w-4" />}
                value={settings.autoRunOnBoot}
                onChange={(value) => onChange({ ...settings, autoRunOnBoot: value })}
                yesLabel={t.yes}
                noLabel={t.no}
              />

              <ToggleRow
                label={t.hideOnBoot}
                checked={settings.hideOnSystemTrayWhenAutoRunOnBoot}
                onCheckedChange={(checked) => onChange({ ...settings, hideOnSystemTrayWhenAutoRunOnBoot: checked })}
              />

              <ToggleRow
                label={t.minimizeOnClose}
                checked={settings.minimizeAppToSystemTrayAtClose}
                onCheckedChange={(checked) => onChange({ ...settings, minimizeAppToSystemTrayAtClose: checked })}
              />

              <ToggleRow
                label={t.floating}
                checked={settings.floatingSystemInformationWindow}
                onCheckedChange={(checked) => onChange({ ...settings, floatingSystemInformationWindow: checked })}
              />
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm">
              <div className="mb-3 flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-muted p-2 text-muted-foreground">
                  <Globe2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.languageLabel}</p>
                  <p className="text-xs text-muted-foreground">{t.languageHint}</p>
                </div>
              </div>
              <div className="inline-flex rounded-lg border border-border/80 bg-muted/40 p-1">
                <SegmentedButton
                  active={settings.language === "en"}
                  onClick={() => onChange({ ...settings, language: "en" })}
                >
                  English
                </SegmentedButton>
                <SegmentedButton
                  active={settings.language === "fr"}
                  onClick={() => onChange({ ...settings, language: "fr" })}
                >
                  Francais
                </SegmentedButton>
              </div>
            </section>

            <section className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm">
              <div className="mb-3 flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-muted p-2 text-muted-foreground">
                  <Thermometer className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.tempLabel}</p>
                  <p className="text-xs text-muted-foreground">{t.temperatureHint}</p>
                </div>
              </div>
              <div className="inline-flex rounded-lg border border-border/80 bg-muted/40 p-1">
                <SegmentedButton
                  active={settings.temperatureDisplay === "celsius"}
                  onClick={() => onChange({ ...settings, temperatureDisplay: "celsius" })}
                >
                  {t.celsius}
                </SegmentedButton>
                <SegmentedButton
                  active={settings.temperatureDisplay === "fahrenheit"}
                  onClick={() => onChange({ ...settings, temperatureDisplay: "fahrenheit" })}
                >
                  {t.fahrenheit}
                </SegmentedButton>
              </div>
            </section>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm">
              <div className="mb-3 flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-muted p-2 text-muted-foreground">
                  <MonitorCog className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.theme}</p>
                  <p className="text-xs text-muted-foreground">{t.themeHint}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={settings.theme === "dark" ? "default" : "outline"}
                  onClick={() => onChange({ ...settings, theme: "dark" })}
                  className="justify-center gap-2"
                >
                  <MoonStar className="h-4 w-4" />
                  {t.dark}
                </Button>
                <Button
                  variant={settings.theme === "light" ? "default" : "outline"}
                  onClick={() => onChange({ ...settings, theme: "light" })}
                  className="justify-center gap-2"
                >
                  <SunMedium className="h-4 w-4" />
                  {t.light}
                </Button>
              </div>
            </section>

            <section className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm">
              <div className="mb-3 flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-muted p-2 text-muted-foreground">
                  <Wind className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.service}</p>
                  <p className="text-xs text-muted-foreground">{t.softwareHint}</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => void onCheckUpdate()}
                disabled={saving}
                className="w-full justify-center gap-2"
              >
                <UploadCloud className="h-4 w-4" />
                {saving ? "..." : t.update}
              </Button>
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
