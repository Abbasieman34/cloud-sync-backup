import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import ActivityPage from "./pages/Activity";
import AdminPage from "./pages/Admin";
import CompanionPage from "./pages/Companion";
import FilesPage from "./pages/Files";
import Home from "./pages/Home";
import SchedulesPage from "./pages/Schedules";

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"}><ProtectedPage><Home /></ProtectedPage></Route>
      <Route path={"/files"}><ProtectedPage><FilesPage /></ProtectedPage></Route>
      <Route path={"/schedules"}><ProtectedPage><SchedulesPage /></ProtectedPage></Route>
      <Route path={"/companion"}><ProtectedPage><CompanionPage /></ProtectedPage></Route>
      <Route path={"/activity"}><ProtectedPage><ActivityPage /></ProtectedPage></Route>
      <Route path={"/admin"}><ProtectedPage><AdminPage /></ProtectedPage></Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
