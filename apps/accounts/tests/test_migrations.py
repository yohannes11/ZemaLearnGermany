from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class UsernameBackfillMigrationTests(TransactionTestCase):
    """Accounts created before usernames existed get one made from their email address."""

    before = [("accounts", "0001_initial")]
    after = [("accounts", "0003_username_required")]

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def test_existing_accounts_get_unique_usernames(self):
        old_apps = self.migrate(self.before)
        OldUser = old_apps.get_model("accounts", "User")
        for email in ("marta@example.com", "Marta@other.org", "a@example.com"):
            OldUser.objects.create(email=email, name="X", password="!")

        new_apps = self.migrate(self.after)
        User = new_apps.get_model("accounts", "User")
        usernames = dict(User.objects.values_list("email", "username"))
        self.assertEqual(usernames["marta@example.com"], "marta")
        self.assertEqual(usernames["Marta@other.org"], "Marta2")
        self.assertEqual(usernames["a@example.com"], "auser")

    def tearDown(self):
        self.migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())
