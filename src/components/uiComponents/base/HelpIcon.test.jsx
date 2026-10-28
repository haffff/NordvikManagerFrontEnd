import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';
import { HelpIcon } from './HelpIcon';

describe('HelpIcon', () => {
  const ORIGINAL_ENV = process.env.REACT_APP_CENTRAL_URL;

  beforeEach(() => {
    process.env.REACT_APP_CENTRAL_URL = 'https://central.example.com';
    vi.spyOn(window, 'open').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.REACT_APP_CENTRAL_URL = ORIGINAL_ENV;
    vi.restoreAllMocks();
  });

  it('renders nothing when text is falsy', () => {
    const { container } = render(<HelpIcon text={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is not clickable and has no click handler when only text is given', () => {
    renderWithProviders(<HelpIcon text="Explains the field" />);
    const icon = screen.getByTestId('help-icon');
    icon.click();
    expect(window.open).not.toHaveBeenCalled();
  });

  it('opens the resolved Central docs URL in a new tab when clicked with a relative docUrl', () => {
    renderWithProviders(<HelpIcon text="Explains the field" docUrl="/documentation/tokens" />);
    screen.getByTestId('help-icon').click();
    expect(window.open).toHaveBeenCalledWith(
      'https://central.example.com/documentation/tokens',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('opens an absolute docUrl unchanged', () => {
    renderWithProviders(<HelpIcon text="Explains the field" docUrl="https://elsewhere.example.com/docs" />);
    screen.getByTestId('help-icon').click();
    expect(window.open).toHaveBeenCalledWith(
      'https://elsewhere.example.com/docs',
      '_blank',
      'noopener,noreferrer'
    );
  });
});
