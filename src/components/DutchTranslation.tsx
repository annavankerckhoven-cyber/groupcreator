import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { isDutchPath } from "@/lib/i18n";

const exact: Record<string, string> = {
  "Page not found": "Pagina niet gevonden",
  "The page you're looking for doesn't exist or has been moved.": "De pagina die je zoekt bestaat niet of is verplaatst.",
  "Go home": "Naar de startpagina",
  "This page didn't load": "Deze pagina kon niet worden geladen",
  "Something went wrong on our end. You can try refreshing or head back home.": "Er is iets misgegaan. Vernieuw de pagina of ga terug naar de startpagina.",
  "Try again": "Opnieuw proberen",
  "Buy me a coffee": "Trakteer me op een koffie",
  "Go to dashboard": "Naar dashboard",
  "Log in / Sign up": "Inloggen / Registreren",
  "Help": "Help",
  "Sign out": "Uitloggen",
  "100% free, forever": "100% gratis, voor altijd",
  "Making group work work.": "Laat groepswerk écht werken.",
  "Let your students quietly say who they'd like to work with — and who they really shouldn't. Group Creator turns those answers into balanced groups.": "Laat je leerlingen discreet aangeven met wie ze graag samenwerken — en met wie liever niet. Group Creator zet hun antwoorden om in evenwichtige groepen.",
  "Get started — completely free": "Aan de slag — volledig gratis",
  "How it works →": "Hoe het werkt →",
  "Create a class": "Maak een klas",
  "Enter student names or import a CSV/Excel file. Done in 30 seconds.": "Voer leerlingnamen in of importeer een CSV- of Excel-bestand. Klaar in 30 seconden.",
  "Share a form": "Deel een formulier",
  "Students pick who they'd like to work with — and who not, completely anonymous.": "Leerlingen kiezen volledig anoniem met wie ze wel en niet willen samenwerken.",
  "Generate groups": "Maak groepen",
  "Set a group size and hit go. Hard avoids are respected, friendships honored.": "Kies een groepsgrootte en start. We houden rekening met vriendschappen en vermijden ongewenste combinaties.",
  "Back home": "Terug naar start",
  "Welcome to Group Creator": "Welkom bij Group Creator",
  "Sign in": "Inloggen",
  "Sign up": "Registreren",
  "Email": "E-mailadres",
  "Password": "Wachtwoord",
  "Forgot password?": "Wachtwoord vergeten?",
  "Signing in…": "Bezig met inloggen…",
  "Your name": "Je naam",
  "Creating…": "Bezig met aanmaken…",
  "Create account": "Account aanmaken",
  "Reset your password": "Je wachtwoord opnieuw instellen",
  "Enter the email address of your account and we'll send you a link to reset your password.": "Vul het e-mailadres van je account in. We sturen je een link om je wachtwoord opnieuw in te stellen.",
  "Go back": "Terug",
  "Sending…": "Bezig met verzenden…",
  "Send reset link": "Herstellink versturen",
  "Choose a new password": "Kies een nieuw wachtwoord",
  "This reset link is invalid or has expired. Request a new one from the sign-in page.": "Deze herstellink is ongeldig of verlopen. Vraag een nieuwe aan op de inlogpagina.",
  "Back to sign in": "Terug naar inloggen",
  "New password": "Nieuw wachtwoord",
  "Confirm new password": "Bevestig nieuw wachtwoord",
  "Updating…": "Bezig met bijwerken…",
  "Update password": "Wachtwoord bijwerken",
  "Your classes": "Je klassen",
  "New class": "Nieuwe klas",
  "Sort by": "Sorteren op",
  "Search…": "Zoeken…",
  "Filter by label": "Filteren op label",
  "No labels yet": "Nog geen labels",
  "Clear labels": "Labels wissen",
  "Loading…": "Laden…",
  "Active classes": "Actieve klassen",
  "Active classes are moved to Archive automatically after 1 year.": "Actieve klassen worden na 1 jaar automatisch naar het archief verplaatst.",
  "No active classes": "Geen actieve klassen",
  "Create your first class. Paste a list of names or import a CSV/Excel file.": "Maak je eerste klas. Plak een namenlijst of importeer een CSV- of Excel-bestand.",
  "Create a class": "Klas aanmaken",
  "Archive": "Archief",
  "No archived classes.": "Geen gearchiveerde klassen.",
  "Delete class": "Klas verwijderen",
  "Cancel": "Annuleren",
  "Delete": "Verwijderen",
  "Deleting…": "Bezig met verwijderen…",
  "All classes": "Alle klassen",
  "Archived": "Gearchiveerd",
  "Add labels…": "Labels toevoegen…",
  "Projects": "Projecten",
  "Each project is one way of dividing the class — set the group size, then make runs to compute groups.": "Elk project is een manier om de klas te verdelen — kies de groepsgrootte en voer daarna berekeningen uit om groepen te maken.",
  "New project": "Nieuw project",
  "No projects yet.": "Nog geen projecten.",
  "Student link": "Link voor leerlingen",
  "Share this with your students. They open it, pick their name, and fill the form.": "Deel deze link met je leerlingen. Ze openen hem, kiezen hun naam en vullen het formulier in.",
  "Copy": "Kopiëren",
  "Students": "Leerlingen",
  "Add student": "Leerling toevoegen",
  "Delete project": "Project verwijderen",
  "Clone project": "Project kopiëren",
  "Select by class name": "Selecteren op klasnaam",
  "Select by label": "Selecteren op label",
  "No other active classes.": "Geen andere actieve klassen.",
  "Select all": "Alles selecteren",
  "No labels available on other active classes.": "Geen labels beschikbaar bij andere actieve klassen.",
  "Clone": "Kopiëren",
  "Delete student": "Leerling verwijderen",
  "Edit project": "Project bewerken",
  "Name": "Naam",
  "Students per group": "Leerlingen per groep",
  "If it doesn't divide evenly": "Als de verdeling niet gelijk uitkomt",
  "Some groups with 1 additional person": "Sommige groepen met 1 persoon extra",
  "Some groups with 1 fewer person": "Sommige groepen met 1 persoon minder",
  "Saving…": "Bezig met opslaan…",
  "Save": "Opslaan",
  "Create project": "Project aanmaken",
  "Student name": "Naam van leerling",
  "Adding…": "Bezig met toevoegen…",
  "Back to class": "Terug naar klas",
  "Runs": "Berekeningen",
  "Each run computes max. 5 group distributions.": "Elke berekening maakt maximaal 5 groepsverdelingen.",
  "New run": "Nieuwe berekening",
  "No runs yet. Create one to compute groups.": "Nog geen berekeningen. Maak er een om groepen te berekenen.",
  "Delete run": "Berekening verwijderen",
  "New run": "Nieuwe berekening",
  "Run name": "Naam van berekening",
  "Absent students (excluded from this run)": "Afwezige leerlingen (uitgesloten van deze berekening)",
  "No students in this class.": "Geen leerlingen in deze klas.",
  "Time to run": "Rekentijd",
  "Run": "Starten",
  "Starting…": "Bezig met starten…",
  "Back to project": "Terug naar project",
  "Show distribution details": "Details van verdeling tonen",
  "Show distribution details?": "Details van verdeling tonen?",
  "Are you sure you want to show the distribution details? It contains sensitive information that should not be shared with students.": "Weet je zeker dat je de details van de verdeling wilt tonen? Deze bevatten gevoelige informatie die niet met leerlingen mag worden gedeeld.",
  "Show details": "Details tonen",
  "Restart run": "Berekening opnieuw starten",
  "Start run": "Berekening starten",
  "Optimizing…": "Bezig met optimaliseren…",
  "Keep this tab open. Closing it cancels the run.": "Houd dit tabblad open. Als je het sluit, wordt de berekening geannuleerd.",
  "Unwanted pairings": "Ongewenste combinaties",
  "Students without a friend": "Leerlingen zonder gekozen vriend(in)",
  "View": "Bekijken",
  "Distribution": "Verdeling",
  "Score": "Score",
  "Groups": "Groepen",
  "Download": "Downloaden",
  "Close": "Sluiten",
  "Pick your name": "Kies je naam",
  "Select your name": "Selecteer je naam",
  "For each classmate": "Voor elke klasgenoot",
  "Choose whether you'd like to work with them. Your classmates won't see your answers.": "Geef aan of je met deze klasgenoot wilt samenwerken. Je klasgenoten kunnen je antwoorden niet zien.",
  "It is advised not to enter too many \"Not together\" preferences.": "We raden aan niet te veel voorkeuren voor ‘Niet samen’ in te voeren.",
  "The fewer \"Not together\" preferences you enter, the more likely they are to be respected.": "Hoe minder voorkeuren voor ‘Niet samen’ je invoert, hoe groter de kans dat we er rekening mee kunnen houden.",
  "Together": "Samen",
  "Doesn't matter": "Maakt niet uit",
  "Not together": "Niet samen",
  "Saving…": "Bezig met opslaan…",
  "Submit": "Indienen",
  "Thanks!": "Bedankt!",
  "Your preferences have been saved. You can close this tab.": "Je voorkeuren zijn opgeslagen. Je kunt dit tabblad sluiten.",
  "This link is no longer valid.": "Deze link is niet meer geldig.",
  "User guide": "Handleiding",
  "Get started": "Aan de slag",
  "Report an issue": "Een probleem melden",
  "Suggest a new feature": "Een nieuwe functie voorstellen",
};

const replacements: Array<[RegExp, string]> = [
  [/^Step (\d+)$/, "Stap $1"],
  [/^(\d+) students?$/, "$1 leerlingen"],
  [/^(\d+) of (\d+) students have submitted their preferences\.$/, "$1 van $2 leerlingen hebben hun voorkeuren ingediend."],
  [/^Groups of (\d+)$/, "Groepen van $1"],
  [/^Group (\d+)$/, "Groep $1"],
  [/^(\d+) groups$/, "$1 groepen"],
  [/^Top (\d+) distributions$/, "Beste $1 verdelingen"],
  [/^Distribution #(\d+) · Score (.+)$/, "Verdeling #$1 · Score $2"],
  [/^(\d+) iterations$/, "$1 iteraties"],
  [/^Best score: (.+)$/, "Beste score: $1"],
  [/^Absent students: /, "Afwezige leerlingen: "],
  [/^some groups \+1$/, "sommige groepen +1"],
  [/^some groups −1$/, "sommige groepen −1"],
];

function translateValue(value: string) {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const core = value.trim();
  if (!core) return value;
  const direct = exact[core];
  if (direct) return `${leading}${direct}${trailing}`;
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(core)) return `${leading}${core.replace(pattern, replacement)}${trailing}`;
  }
  return value;
}

function translateElement(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest(".notranslate,[translate='no'],script,style")) continue;
    const next = translateValue(node.data);
    if (next !== node.data) node.data = next;
  }
  if (root instanceof Element) {
    for (const element of [root, ...Array.from(root.querySelectorAll("[placeholder],[title],[aria-label]"))]) {
      if (element.closest(".notranslate,[translate='no']")) continue;
      for (const attr of ["placeholder", "title", "aria-label"]) {
        const value = element.getAttribute(attr);
        if (value) element.setAttribute(attr, translateValue(value));
      }
    }
  }
}

export function DutchTranslation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (!isDutchPath(pathname)) return;
    document.documentElement.lang = "nl";
    translateElement(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target.parentNode) {
          translateElement(mutation.target.parentNode);
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) translateElement(node as Element);
          if (node.nodeType === Node.TEXT_NODE && node.parentNode) translateElement(node.parentNode);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const preserveDutch = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (anchor.pathname === "/nl" || anchor.pathname.startsWith("/nl/")) return;
      event.preventDefault();
      window.location.assign(`/nl${anchor.pathname === "/" ? "" : anchor.pathname}${anchor.search}${anchor.hash}`);
    };
    document.addEventListener("click", preserveDutch, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", preserveDutch, true);
    };
  }, [pathname]);

  return null;
}