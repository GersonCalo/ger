import { useFinanceApp } from '@/hooks/useFinanceApp';
import { AppRoutes } from '@/routes/AppRoutes';

function App() {
  const financeApp = useFinanceApp();

  return <AppRoutes financeApp={financeApp} />;
}

export default App;
