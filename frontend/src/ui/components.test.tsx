import { fireEvent, screen } from '@testing-library/react-native';

import { renderUi } from '@/test/renderUi';

import { Button } from './Button';
import { Notice } from './Notice';
import { TextField } from './TextField';

describe('Button', () => {
  it('presses and is a button for assistive technology', async () => {
    const onPress = jest.fn();
    await renderUi(<Button onPress={onPress}>Sync now</Button>);

    await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled', async () => {
    const onPress = jest.fn();
    await renderUi(
      <Button onPress={onPress} disabled>
        Sync now
      </Button>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('ignores presses while it is busy and says so', async () => {
    const onPress = jest.fn();
    await renderUi(
      <Button onPress={onPress} loading>
        Connect
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Connect, in progress' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Notice', () => {
  it('names the tone for assistive technology and offers its action', async () => {
    const onPress = jest.fn();
    await renderUi(
      <Notice
        tone="warning"
        title="TipRanks is rate limiting requests"
        action={{ label: 'Open connections', onPress }}
      >
        The next attempt is scheduled automatically.
      </Notice>,
    );

    expect(screen.getByLabelText('Warning: TipRanks is rate limiting requests')).toBeOnTheScreen();
    expect(screen.getByText('The next attempt is scheduled automatically.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Open connections' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is an alert when something went wrong', async () => {
    await renderUi(<Notice tone="danger" title="eToro rejected your credentials" />);

    expect(screen.getByRole('alert')).toBeOnTheScreen();
  });
});

describe('TextField', () => {
  it('shows the validation message and reports changes', async () => {
    const onChangeText = jest.fn();
    await renderUi(
      <TextField label="Email" value="" onChangeText={onChangeText} error="Enter a valid email." />,
    );

    expect(screen.getByText('Enter a valid email.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'a@example.com');
    expect(onChangeText).toHaveBeenCalledWith('a@example.com');
  });

  it('masks a secret and can reveal it on request', async () => {
    await renderUi(
      <TextField label="API key" value="sk-123" onChangeText={() => undefined} secret />,
    );

    const input = screen.getByLabelText('API key');
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.autoComplete).toBe('off');
    expect(input.props.autoCorrect).toBe(false);

    await fireEvent.press(screen.getByLabelText('Show API key'));

    expect(screen.getByLabelText('API key').props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText('Hide API key')).toBeOnTheScreen();
  });

  it('does not mask ordinary fields', async () => {
    await renderUi(<TextField label="Display name" value="Ada" onChangeText={() => undefined} />);

    expect(screen.getByLabelText('Display name').props.secureTextEntry).toBeFalsy();
  });
});
