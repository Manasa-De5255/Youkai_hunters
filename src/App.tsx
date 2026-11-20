import { useEffect, useRef, useState } from 'react';
import CustomizationStudioScreen from './components/CustomizationStudioScreen';
import GameWorldScreen from './components/GameWorldScreen';
import OpeningAuthScreen from './components/OpeningAuthScreen';
import ProfileSetupScreen from './components/ProfileSetupScreen';
import { getDefaultCustomization } from './data/customizationCatalog';
import { KodamaSpawnKind } from './data/kodamaChallenge';
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
  updatePlayerProfile,
} from './utils/apiClient';

export default function App() {
  const [player, setPlayer] = useState<PlayerAccount | null>(null);
  const [screen, setScreen] = useState<AppScreen>('auth');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [draftCustomization, setDraftCustomization] = useState<CharacterCustomization>(() =>
    getDefaultCustomization('male'),
  );
  const rewardedGhostKeysRef = useRef<Set<string>>(new Set());

  // Sync body state attribute for testability & clean transitions
  useEffect(() => {
    document.body.dataset.state = screen;
  }, [screen]);

  const applyAuthenticatedPlayer = (authedPlayer: PlayerAccount) => {
    rewardedGhostKeysRef.current.clear();
    setPlayer(authedPlayer);
    setDraftCustomization(
      authedPlayer.gender === 'male'
        ? authedPlayer.maleCustomization
        : authedPlayer.femaleCustomization,
    );
    // Only ask for Player Name + Gender on first login; later logins load saved profile into gameplay
    setScreen(authedPlayer.profileCompleted ? 'playing' : 'profile-setup');
  };

  // Restore session on initial mount
  useEffect(() => {
    let active = true;
    fetchCurrentPlayer().then((existing) => {
      if (!active) return;
      if (existing) {
        applyAuthenticatedPlayer(existing);
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
    applyAuthenticatedPlayer(authedPlayer);
  };

  const handleCompleteProfile = async (username: string, gender: Gender) => {
    if (!player) return;
    const updated = await updatePlayerProfile({ username, gender });
    setPlayer(updated);
    setDraftCustomization(
      updated.gender === 'male' ? updated.maleCustomization : updated.femaleCustomization,
    );
    setScreen('playing');
  };

  const handleUpdateProfileSettings = async (username: string, gender: Gender) => {
    if (!player) return;
    const updated = await updatePlayerProfile({ username, gender });
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

  const handleKodamaHit = async (kind: KodamaSpawnKind = 'wall', ghostKey = '') => {
    const isUniqueKey = Boolean(ghostKey && !rewardedGhostKeysRef.current.has(ghostKey));
    if (ghostKey) {
      if (rewardedGhostKeysRef.current.has(ghostKey)) {
        return {
          leveledUp: false,
          newLevel: player?.level ?? 1,
          newlyUnlocked: [],
          diamonds: player?.kodamaProgress.diamonds ?? 0,
        };
      }
      rewardedGhostKeysRef.current.add(ghostKey);
    }

    // Immediate optimistic diamond update for running ghost kills
    if (kind === 'crossing' && (!ghostKey || isUniqueKey)) {
      setPlayer((prev) =>
        prev
          ? {
              ...prev,
              kodamaProgress: {
                ...prev.kodamaProgress,
                diamonds: prev.kodamaProgress.diamonds + 1,
              },
            }
          : prev,
      );
    }

    const result = await recordKodamaHit(kind, ghostKey || undefined);
    setPlayer(result.player);
    return {
      leveledUp: result.leveledUp,
      newLevel: result.player.level,
      newlyUnlocked: result.newlyUnlocked,
      diamonds: result.player.kodamaProgress.diamonds,
    };
  };

  const handleExitToMainMenu = async () => {
    if (player) {
      try {
        const saved = await updatePlayerCustomization(player.gender, draftCustomization);
        setPlayer(saved);
      } catch {
        // Diamonds & rounds already persist server-side after every hit/round
      }
    }
    setScreen('customize');
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
    rewardedGhostKeysRef.current.clear();
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

  if (screen === 'profile-setup') {
    return (
      <ProfileSetupScreen
        player={player}
        onCompleteProfile={handleCompleteProfile}
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
        onUpdateProfile={handleUpdateProfileSettings}
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
      onUpdateProfile={handleUpdateProfileSettings}
      onReturnToCustomize={() => setScreen('customize')}
      onExitToMenu={handleExitToMainMenu}
      onLogout={handleLogout}
    />
  );
}
