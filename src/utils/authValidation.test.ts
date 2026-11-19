import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePasswordResetInput,
  validatePlayerId,
  validateRegistrationInput,
  validateUsername,
} from './authValidation';

test('validateUsername and validatePlayerId enforce length and allowed characters', () => {
  assert.equal(validateUsername('ab').valid, false);
  assert.equal(validateUsername('Kenshin_01').valid, true);
  assert.equal(validateUsername('bad name!').valid, false);

  assert.equal(validatePlayerId('A').valid, false);
  assert.equal(validatePlayerId('YH-9901').valid, true);
  assert.equal(validatePlayerId('HUNTER_7').valid, true);
  assert.equal(validatePlayerId('bad id!').valid, false);
});

test('validateRegistrationInput catches mismatched passwords, invalid playerId, and missing gender', () => {
  const mismatch = validateRegistrationInput({
    username: 'Kenshin',
    password: 'password123',
    confirmPassword: 'password999',
    gender: 'male',
    recoveryAnswer: 'fox',
  });
  assert.equal(mismatch.valid, false);

  const badPid = validateRegistrationInput({
    username: 'Kenshin',
    playerId: 'X',
    password: 'password123',
    confirmPassword: 'password123',
    gender: 'male',
    recoveryAnswer: 'fox',
  });
  assert.equal(badPid.valid, false);

  const noGender = validateRegistrationInput({
    username: 'Kenshin',
    password: 'password123',
    confirmPassword: 'password123',
    gender: '',
    recoveryAnswer: 'fox',
  });
  assert.equal(noGender.valid, false);

  const valid = validateRegistrationInput({
    username: 'Kenshin',
    playerId: 'YH-KENSHIN-1',
    password: 'password123',
    confirmPassword: 'password123',
    gender: 'male',
    recoveryAnswer: 'silver fox',
  });
  assert.equal(valid.valid, true);
});

test('validatePasswordResetInput checks recovery answer and password match', () => {
  assert.equal(
    validatePasswordResetInput({
      username: 'Kenshin',
      recoveryAnswer: '',
      newPassword: 'newpassword1',
      confirmNewPassword: 'newpassword1',
    }).valid,
    false,
  );
  assert.equal(
    validatePasswordResetInput({
      username: 'Kenshin',
      recoveryAnswer: 'silver fox',
      newPassword: 'newpassword1',
      confirmNewPassword: 'newpassword1',
    }).valid,
    true,
  );
});
