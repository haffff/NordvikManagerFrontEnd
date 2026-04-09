import * as React from 'react';
import { Box, Button, Heading, Input, Stack, Text } from '@chakra-ui/react';
import CentralWebHelper from '../../helpers/CentralWebHelper';
import TokenStore from '../../helpers/TokenStore';
import { toaster } from '../ui/toaster';

// code       — pre-filled invite code from URL (optional)
// requiresCode — whether the server demands an invite code
// onBack     — back-to-login handler (shown when no code in URL)
// OnSuccess  — called after successful registration
export const PlayerRegisterForm = ({ code, requiresCode, onBack, OnSuccess }) => {
  const [form, setForm] = React.useState({ inviteCode: code ?? '' });
  const [codeValid, setCodeValid] = React.useState(null); // null | true | false
  const [errors, setErrors] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  // Pre-validate invite code if one was passed via URL
  React.useEffect(() => {
    if (!code) return;
    CentralWebHelper.getAsync(`user/CheckRegistrationKey?key=${code}`)
      .then((resp) => setCodeValid(resp !== undefined))
      .catch(() => setCodeValid(false));
  }, [code]);

  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const onSubmit = async () => {
    setErrors([]);
    if (form.password !== form.confirmPassword) {
      setErrors(['Passwords do not match.']);
      return;
    }
    setLoading(true);
    try {
      const resp = await CentralWebHelper.postAsync('user/register', form);
      if (!resp) { setErrors(['Connection error. Please try again.']); return; }

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        setErrors(
          data.errors
            ? data.errors.map((e) => e.msg)
            : [data.error ?? 'Registration failed.']
        );
        return;
      }

      TokenStore.setTokens(data.accessToken, data.refreshToken);
      toaster.create({
        title: 'Account created.',
        description: "You're now logged in.",
        type: 'success',
        duration: 5000,
      });
      window.history.replaceState({}, document.title, window.location.pathname);
      OnSuccess();
    } finally {
      setLoading(false);
    }
  };

  if (code && codeValid === false) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Heading as="h6" size="xs" color="red.400">
          Invitation link is invalid or has expired.
        </Heading>
      </Box>
    );
  }

  return (
    <form
      onKeyUp={(e) => { if (e.key === 'Enter') onSubmit(); }}
      onSubmit={(e) => e.preventDefault()}
      style={{ width: '400px', margin: '0 auto', marginTop: '50px' }}
    >
      <Stack spacing={4}>
        {errors.length > 0 && (
          <Box color="red.400" fontSize="sm">
            {errors.map((msg, i) => <Text key={i}>{msg}</Text>)}
          </Box>
        )}

        <Heading as="h6" size="xs">Username</Heading>
        <Input
          placeholder="Username"
          onInput={(e) => setField('UserName', e.target.value)}
        />

        <Heading as="h6" size="xs">Password</Heading>
        <Input
          type="password"
          placeholder="Password"
          onInput={(e) => setField('password', e.target.value)}
        />

        <Heading as="h6" size="xs">Confirm Password</Heading>
        <Input
          type="password"
          placeholder="Confirm password"
          onInput={(e) => setField('confirmPassword', e.target.value)}
        />

        <Heading as="h6" size="xs">Email (optional)</Heading>
        <Input
          type="email"
          placeholder="Email"
          onInput={(e) => setField('email', e.target.value)}
        />

        {/* Show invite code field only when the server requires it */}
        {requiresCode && (
          <>
            <Heading as="h6" size="xs">Invite Code</Heading>
            <Input
              placeholder="Invite code"
              value={form.inviteCode}
              disabled={Boolean(code)}
              borderColor={code && codeValid ? 'green.400' : 'gray.200'}
              onInput={(e) => setField('inviteCode', e.target.value)}
            />
          </>
        )}

        <Button variant="outline" loading={loading} onClick={onSubmit}>
          Register
        </Button>

        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            Back to login
          </Button>
        )}
      </Stack>
    </form>
  );
};

export default PlayerRegisterForm;
