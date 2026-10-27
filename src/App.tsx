import { Route, Switch } from 'wouter';
import { Home } from './ui/Home.tsx';
import { UserPage } from './ui/UserPage.tsx';

export function App() {
  return (
    <Switch>
      <Route path="/u/:user">{({ user }) => <UserPage user={user} />}</Route>
      <Route component={Home} />
    </Switch>
  );
}
