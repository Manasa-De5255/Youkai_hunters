import { useEffect, useState } from 'react';
import CustomizationStudioScreen from './components/CustomizationStudioScreen';
import GameWorldScreen from './components/GameWorldScreen';
import GenderSelectionScreen from './components/GenderSelectionScreen';
import OpeningAuthScreen from './components/OpeningAuthScreen';
import { getDefaultCustomization } from './data/customizationCatalog';
import { findLockedCustomizationError } from './data/progressionCatalog';
import {
  ActivityId,
  AppScreen,
  CharacterCustomization,
  Gender,
  PlayerAccount,
} from './types/game';
import {
  fetchCurrentPlayer,
  logoutPlayerAccount,
  recordKodamaHit,
  recordKodamaRound,
  recordPlayerProgress,
  updatePlayerCustomization,
  updatePlayerGender,
} from './utils/apiClient';

export default function App() {
  const [player, setPlayer] = useState<PlayerAccount | null>(null);
  const [screen, setScreen] = useState<AppScreen>('auth');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [draftCustomization, setDraftCustomization] = useState<CharacterCustomization>(() =>
    getDefaultCustomization('male'),
  );

  // Sync body state attribute for testability & clean transitions
  useEffect(() => {
    document.body.dataset.state = screen;
  }, [screen]);

  // Restore session on initial mount
  useEffect(() => {
    let active = true;
    fetchCurrentPlayer().then((existing) => {
      if (!active) return;
      if (existing) {
        setPlayer(existing);
        setDraftCustomization(
          existing.gender === 'male'
            ? existing.maleCustomization
            : existing.femaleCustomization,
        );
        setScreen('gender-select');
      } else {
        setScreen('auth');
      }
      setCheckingAuth(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleAuthenticated = (authedPlayer: PlayerAccount) => {
    setPlayer(authedPlayer);
    setDraftCustomization(
      authedPlayer.gender === 'male'
        ? authedPlayer.maleCustomization
        : authedPlayer.femaleCustomization,
    );
    setScreen('gender-select');
  };

  const handleSelectGender = async (gender: Gender) => {
    if (!player) return;
    const updated = await updatePlayerGender(gender);
    setPlayer(updated);
    setDraftCustomization(
      updated.gender === 'male' ? updated.maleCustomization : updated.femaleCustomization,
    );
  };

  const handleChangeCustomization = (next: CharacterCustomization) => {
    if (!player) return;
    const lockedError = findLockedCustomizationError(
      next,
      draftCustomization,
      player.level,
      player.unlockedItems,
    );
    if (lockedError) {
      return;
    }

    setDraftCustomization(next);
    const nextPlayer: PlayerAccount =
      player.gender === 'male'
        ? { ...player, maleCustomization: next }
        : { ...player, femaleCustomization: next };
    setPlayer(nextPlayer);
    void updatePlayerCustomization(player.gender, next)
      .then((saved) => {
        setPlayer(saved);
      })
      .catch(() => {
        // Final explicit save runs on START GAME as well
      });
  };

  const handleSaveAndStartGame = async () => {
    if (!player) return;
    const saved = await updatePlayerCustomization(player.gender, draftCustomization);
    setPlayer(saved);
    setDraftCustomization(
      saved.gender === 'male' ? saved.maleCustomization : saved.femaleCustomization,
    );
    setScreen('playing');
  };

  const handleRecordActivity = async (activityId: ActivityId) => {
    const result = await recordPlayerProgress(activityId);
    setPlayer(result.player);
    return {
      leveledUp: result.leveledUp,
      newLevel: result.player.level,
      newlyUnlocked: result.newlyUnlocked,
    };
  };

  const handleKodamaHit = async () => {
    const result = await recordKodamaHit();
    setPlayer(result.player);
    return {
      leveledUp: result.leveledUp,
      newLevel: result.player.level,
      newlyUnlocked: result.newlyUnlocked,
      diamonds: result.player.kodamaProgress.diamonds,
    };
  };

  const handleKodamaRoundComplete = async (round: number, hits: number) => {
    const result = await recordKodamaRound(round, hits);
    setPlayer(result.player);
    return {
      passed: result.passed,
      newlyCompleted: result.newlyCompleted,
      stage2JustUnlocked: result.stage2JustUnlocked,
      completedRounds: result.player.kodamaProgress.completedRounds,
      stage2Unlocked: result.player.kodamaProgress.stage2Unlocked,
      diamonds: result.player.kodamaProgress.diamonds,
    };
  };

  const handleLogout = async () => {
    await logoutPlayerAccount().catch(() => undefined);
    setPlayer(null);
    setScreen('auth');
  };

  if (checkingAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#040712] text-sm tracking-wider text-cyan-200">
        Awakening Sanctuary...
      </div>
    );
  }

  if (!player || screen === 'auth') {
    return <OpeningAuthScreen onAuthenticated={handleAuthenticated} />;
  }

  if (screen === 'gender-select') {
    return (
      <GenderSelectionScreen
        player={player}
        onSelectGender={handleSelectGender}
        onProceedToCustomize={() => setScreen('customize')}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === 'customize') {
    return (
      <CustomizationStudioScreen
        player={player}
        customization={draftCustomization}
        onChangeCustomization={handleChangeCustomization}
        onSwitchGenderScreen={() => setScreen('gender-select')}
        onSaveAndStartGame={handleSaveAndStartGame}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <GameWorldScreen
      player={player}
      customization={draftCustomization}
      onRecordActivity={handleRecordActivity}
      onKodamaHit={handleKodamaHit}
      onKodamaRoundComplete={handleKodamaRoundComplete}
      onReturnToCustomize={() => setScreen('customize')}
      onLogout={handleLogout}
    />
  );
}
