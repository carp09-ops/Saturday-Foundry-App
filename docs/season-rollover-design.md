# Confirmed season rollover

Every active coach must explicitly select Stay or Change Program before season creation. The server validates all assignments, prevents duplicate teams, and commits the new season and memberships atomically. A failed operation must leave the previous season active. Historical records remain unchanged. The standalone Change Program tool remains for preseason corrections.

Release gate: verify isolated rollover with all active coaches, duplicate rejection, failed transaction rollback, cross-league authorization, and season history before applying a database migration or merging to main.
