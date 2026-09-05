import assert from 'node:assert/strict';
import test from 'node:test';
import type postgres from 'postgres';
import { readInitialTrialDays } from '../../src/lib/stripe/initial-trial-postgres';

function fakeSql(rows: unknown[]): postgres.Sql {
  return (() => Promise.resolve(rows)) as unknown as postgres.Sql;
}

test('reads one trial only for an account with no durable credit history', async () => {
  assert.equal(await readInitialTrialDays(fakeSql([{
    has_credit_record: false,
    has_trial_grant: false,
  }]), 41, 3), 3);

  assert.equal(await readInitialTrialDays(fakeSql([{
    has_credit_record: true,
    has_trial_grant: false,
  }]), 41, 3), undefined);

  assert.equal(await readInitialTrialDays(fakeSql([{
    has_credit_record: false,
    has_trial_grant: true,
  }]), 41, 3), undefined);
});

test('fails closed when trial history or the account ID is malformed', async () => {
  await assert.rejects(
    readInitialTrialDays(fakeSql([]), 41, 3),
    /could not determine trial history/i,
  );
  await assert.rejects(
    readInitialTrialDays(fakeSql([{
      has_credit_record: 'false',
      has_trial_grant: false,
    }]), 41, 3),
    /could not determine trial history/i,
  );
  await assert.rejects(
    readInitialTrialDays(fakeSql([{
      has_credit_record: false,
      has_trial_grant: false,
    }]), 0, 3),
    /account ID is invalid/i,
  );
});
