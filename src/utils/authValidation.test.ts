import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEmail,
  validatePasswordResetInput,
  validatePlayerId,
  validatePlayerName,
  validateRegistrationInput,
  validateUsername,
} from './authValidation';

test('validateUsername, validatePlayerName, validateEmail, and validatePlayerId enforce constraints', () => {
  assert.equal(validateUsername('ab').valid, false);
  assert.equal(validateUsername('Kenshin_01').valid, true);
  assert.equal(validateUsername('bad name!').valid, false);

  assert.equal(validatePlayerName('A').valid, false);
  assert.equal(validatePlayerName('Kenshin Oda').valid, true);
  assert.equal(validatePlayerName('bad@name').valid, false);

  assert.equal(validateEmail('').valid, false);
  assert.equal(validateEmail('not-an-email').valid, false);
  assert.equal(validateEmail('Hunter@Example.com').valid, true);

  assert.equal(validatePlayerId('A').valid, false);
  assert.equal(validatePlayerId('YH-9901').valid, true);
  assert.equal(validatePlayerId('HUNTER_7').valid, true);
  assert.equal(validatePlayerId('bad id!').valid, false);
});

test('validateRegistrationInput supports email-only registration and validates legacy username registration', () => {
  const emailOnlyValid = validateRegistrationInput({
    email: 'archer@yokai.jp',
    password: 'password123',
    confirmPassword: 'password123',
  });
  assert.equal(emailOnlyValid.valid, true);

  const badEmail = validateRegistrationInput({
    email: 'bad-email',
    password: 'password123',
    confirmPassword: 'password123',
  });
  assert.equal(badEmail.valid, false);

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

test('validatePasswordResetInput checks recovery answer and password match for email or username', () => {
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
      username: 'archer@yokai.jp',
      recoveryAnswer: 'silver fox',
      newPassword: 'newpassword1',
      confirmNewPassword: 'newpassword1',
    }).valid,
    true,
  );
});
