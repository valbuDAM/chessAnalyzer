import { Route, Switch } from 'wouter';
import { GamePage } from './ui/GamePage.tsx';
import { Home } from './ui/Home.tsx';
import { UserPage } from './ui/UserPage.tsx';

export function App() {
  return (
    <Switch>
      {/* keyed so another user starts from a fresh list and reads its own ?months */}
      <Route path="/u/:user">{({ user }) => <UserPage key={user} user={user} />}</Route>
      <Route path="/u/:user/:gameId">{({ user, gameId }) => <GamePage user={user} id={gameId} />}</Route>
      <Route component={Home} />
    </Switch>
  );
}
