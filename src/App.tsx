import { Route, Switch } from 'wouter';
import { GamePage } from './ui/GamePage.tsx';
import { Home } from './ui/Home.tsx';
import { PastedGamePage } from './ui/PastedGamePage.tsx';
import { UserPage } from './ui/UserPage.tsx';

export function App() {
  return (
    <Switch>
      {/* keyed so another user starts from a fresh list and reads its own ?months */}
      <Route path="/u/:user">{({ user }) => <UserPage key={user} user={user} />}</Route>
      <Route path="/u/:user/:gameId">{({ user, gameId }) => <GamePage user={user} id={gameId} />}</Route>
      <Route path="/pgn" component={PastedGamePage} />
      <Route component={Home} />
    </Switch>
  );
}
