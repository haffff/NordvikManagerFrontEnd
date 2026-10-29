import * as React from 'react';
import { Stack, Heading, Input, Button } from '@chakra-ui/react';
import CentralWebHelper from '../../helpers/CentralWebHelper';
import TokenStore from '../../helpers/TokenStore';
import UtilityHelper from '../../helpers/UtilityHelper';
import { toaster } from '../ui/toaster';

export const PlayerLoginPanel = ({ OnSuccess, onRegister }) => {
  const [form, setForm] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  const onSubmit = () => {
    setLoading(true);
    setError(false);
    CentralWebHelper.post(
      'user/login',
      // Central keeps the refresh token in an httpOnly cookie (never in page storage).
      { ...form, refreshMode: 'cookie' },
      (result) => {
        TokenStore.clear(); // drops a refresh token an older build stored
        TokenStore.setAccessToken(result.accessToken);
        setLoading(false);
        OnSuccess();
      },
      () => {
        setError(true);
        setLoading(false);
      },
      () => {
        setLoading(false);
        toaster.create(UtilityHelper.GenerateConnectionErrorToast());
      }
    );
  };

  return (
    <form
      onKeyUp={(e) => { if (e.key === 'Enter') onSubmit(); }}
      onSubmit={(e) => e.preventDefault()}
      className="nm_authForm"
    >
      <Stack spacing={4} borderColor={error ? 'tomato' : 'gray.200'}>
        <Heading as="h6" size="xs">Login</Heading>
        <Input
          placeholder="Username"
          size="md"
          onInput={(e) => setForm({ ...form, UserName: e.target.value })}
        />
        <Heading as="h6" size="xs">Password</Heading>
        <Input
          type="password"
          placeholder="Enter password"
          borderColor={error ? 'tomato' : 'gray.200'}
          onInput={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Button variant="outline" loading={loading} onClick={onSubmit}>
          Login
        </Button>

        {onRegister && (
          <Button variant="ghost" size="sm" onClick={onRegister}>
            Create an account
          </Button>
        )}
      </Stack>
    </form>
  );
};

export default PlayerLoginPanel;
