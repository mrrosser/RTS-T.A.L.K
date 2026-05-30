import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ControlsPanelV2 from '../components/ControlsPanelV2';
import type { Player } from '../types';

const { tightenTranscriptMock } = vi.hoisted(() => ({
  tightenTranscriptMock: vi.fn(),
}));

vi.mock('../services/geminiService', () => ({
  tightenTranscript: (...args: unknown[]) => tightenTranscriptMock(...args),
}));

type ControlsPanelProps = ComponentProps<typeof ControlsPanelV2>;

const localPlayer: Player = {
  id: 'con-1',
  name: 'Con One',
  role: 'Conversationalist',
  violations: { red: 0, yellow: 0, green: 0 },
  indicators: {
    round: 1,
    redRemaining: 0,
    yellowRemaining: 2,
    greenRemaining: 0,
    purpleRemaining: 1,
  },
};

const refereePlayer: Player = {
  id: 'ref-1',
  name: 'Ref One',
  role: 'Referee',
  violations: { red: 0, yellow: 0, green: 0 },
};

const createProps = (overrides: Partial<ControlsPanelProps> = {}): ControlsPanelProps => ({
  localPlayer,
  players: [localPlayer],
  timeline: [],
  timelineSections: [],
  audioDrafts: [],
  audienceChallenges: [],
  refereeActions: [],
  onAddEvent: vi.fn(),
  onFactCheck: vi.fn(),
  onSendMessage: vi.fn(),
  onAssignViolation: vi.fn(),
  onStartTurn: vi.fn(),
  onEndTurn: vi.fn(),
  onPauseTurn: vi.fn(),
  onUpdatePromptCards: vi.fn(),
  onRevealQuestion: vi.fn(),
  onUpdateTrustedSources: vi.fn(),
  onUseLifeline: vi.fn(),
  onUpdateMicState: vi.fn(),
  onSetRefereeMuteState: vi.fn(),
  onAddModerationNote: vi.fn(),
  onAwardScore: vi.fn(),
  onAdvanceRound: vi.fn(),
  onEndGame: vi.fn(),
  onHighlightTimelineEvent: vi.fn(),
  onUpdateSectionSummary: vi.fn(),
  onSubmitAudioDraft: vi.fn(),
  onReviewAudioDraft: vi.fn(),
  onUploadBackdrop: vi.fn(),
  onSubmitAudienceChallenge: vi.fn(),
  isTurnActive: false,
  turnRemaining: 0,
  currentSpeakerId: null,
  currentRound: 1,
  totalRounds: 3,
  chatMessages: [],
  onExit: vi.fn(),
  ...overrides,
});

const renderPanel = (overrides: Partial<ControlsPanelProps> = {}) => render(
  <ControlsPanelV2 {...createProps(overrides)} />,
);

describe('ControlsPanelV2 transcript workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders safely when local player state arrives after the first render', () => {
    const { rerender } = render(<ControlsPanelV2 {...createProps({ localPlayer: undefined })} />);

    expect(screen.queryByRole('heading', { name: 'Controls' })).not.toBeInTheDocument();

    rerender(<ControlsPanelV2 {...createProps({ localPlayer })} />);

    expect(screen.getByRole('heading', { name: 'Controls' })).toBeInTheDocument();
  });

  it('sends referee quick-note shortcuts to the main screen', () => {
    const onAddModerationNote = vi.fn();
    renderPanel({
      localPlayer: refereePlayer,
      players: [refereePlayer, localPlayer],
      onAddModerationNote,
    });

    fireEvent.click(screen.getByRole('button', { name: 'You are veering away from the original question.' }));

    expect(onAddModerationNote).toHaveBeenCalledWith({
      refereeId: 'ref-1',
      text: 'You are veering away from the original question.',
      shortcutKey: 'veer',
    });
  });

  it('locks transcript submission after a chop until the player repeats from the cut', () => {
    renderPanel();

    const transcript = screen.getByPlaceholderText('Live transcript appears here before submit') as HTMLTextAreaElement;
    fireEvent.change(transcript, {
      target: {
        value: 'This is my first point and this is the second point.',
      },
    });

    transcript.focus();
    const cutIndex = 'This is my first point'.length;
    transcript.setSelectionRange(cutIndex, cutIndex);
    fireEvent.click(screen.getByRole('button', { name: 'Chop at Cursor' }));

    expect(transcript).toHaveValue('This is my first point');
    expect(screen.getByText(/repeat anything after the cut before sending/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to Referee' })).toBeDisabled();
  });

  it('applies an explicit Gemini transcript suggestion', async () => {
    tightenTranscriptMock.mockResolvedValue({
      suggestion: 'This is my direct answer.',
      note: 'Removed filler and duplicate phrasing.',
    });

    renderPanel();

    const transcript = screen.getByPlaceholderText('Live transcript appears here before submit');
    fireEvent.change(transcript, {
      target: {
        value: 'Um this is, this is my direct answer.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Gemini Tighten' }));

    await waitFor(() => {
      expect(tightenTranscriptMock).toHaveBeenCalledWith('Um this is, this is my direct answer.');
    });

    expect(await screen.findByText('This is my direct answer.')).toBeInTheDocument();
    expect(screen.getByText('Removed filler and duplicate phrasing.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Use Suggestion' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Live transcript appears here before submit')).toHaveValue('This is my direct answer.');
    });
  });
});
