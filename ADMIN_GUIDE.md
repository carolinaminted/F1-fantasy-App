
# 🛡️ Lights Out League: Admin Guide

Welcome to the Race Control! This guide covers the tools you need to manage the league, from onboarding players to finalizing race results.

**Note:** Access to these features is restricted to accounts with the `isAdmin` flag enabled.

---

## Quick Reference: Admin Dashboard

To access the dashboard, tap the **Admin** icon in the bottom navigation bar (Mobile) or Sidebar (Desktop).

| Tile | Name | Function |
|------|------|----------|
| 👤 | Manage Users | View roster, approve dues, grant admin access |
| 🏁 | Results & Locks | Enter race results and lock/unlock picks |
| 📅 | Schedule | Set race dates and session times |
| 🏎️ | Drivers & Teams | Update the grid, team colors, and active status |
| 🏆 | Scoring | Configure points systems and profiles |
| 🎟️ | Invitations | Generate codes for new player registration |

> **📸 Screenshot 1: Admin Dashboard**
> Show the grid of admin tools and the top header actions (Dues, Sync).

---

## 1. Onboarding: Invitation Codes

The league is invite-only. You must generate codes for players to register.

### How to Manage Codes:

1. Go to **Invitation Codes** (Ticket icon).
2. **Create:** Select a quantity (1, 5, or 10) and tap **Generate**.
3. **Share:** Tap a code in the list to open details, then tap **Copy Code**.
4. **Monitor:** The list shows which codes are `Active`, `Reserved` (in validation), or `Used` (and by whom).

> **📸 Screenshot 2: Invitation Manager**
> Show the list of codes and the generation controls.

---

## 2. Managing Users & Dues

Manage the roster, verify payments, and handle access.

### Approving Dues:

1. Go to **Manage Users** (Profile icon).
2. Filter by **"Unpaid"** to see pending members.
3. Tap a user to open their **Admin Profile View**.
4. Toggle **League Dues** to **"Paid"**.
5. Tap **Save Changes**.

> **📸 Screenshot 3: Admin User Profile View**
> Show the Admin Privileges and League Dues toggles.

### Setting the Season Fee:

1. On the main **Admin Dashboard**, tap the **Dues ($)** button in the header.
2. Enter the amount (e.g., 25.00).
3. Tap **Save Amount**. This updates the payment screen for all players.

### Penalties & Adjustments:

If a player submits picks late or violates rules:
1. Open the user in **Manage Users**.
2. Scroll down to their **Pick History**.
3. Expand the specific race.
4. Use the **Admin Penalty Tribunal** box to enter a percentage deduction (e.g., 20%) and a reason.
5. Tap **Apply Penalty**.

---

## 3. Race Operations: Results & Locks

This is your primary task during a race weekend.

### Locking the Grid:

The system auto-locks based on the Schedule, but you can override it manually.
1. Go to **Results & Locks** (Track icon).
2. Select the **Event** from the dropdown.
3. Tap the **Lock Icon** (top right) to toggle between Locked/Open.

### Entering Results:

1. Wait for the official FIA classification.
2. Select the **Event** in the Results Manager.
3. **Grand Prix:** Enter P1 through P10 finish order.
4. **Qualifying:** Enter P1 through P3.
5. **Fastest Lap:** Select the driver.
6. *(If Sprint Weekend)*: Enter Sprint Finish (P1-P8) and Sprint Quali (P1-P3).
7. Tap the **Save (Disk)** icon.

> **⚠️ CRITICAL:** Saving results automatically triggers a league-wide score recalculation. This may take 10-30 seconds.

> **📸 Screenshot 4: Results Entry Form**
> Show the driver selectors for P1, P2, P3, etc.

---

## 4. Managing the Schedule

Ensure lock times are accurate to prevent unfair picks.

1. Go to **Schedule Manager** (Calendar icon).
2. Tap an **Event Card**.
3. **Timezone:** All times must be entered in **Eastern Standard Time (EST/EDT)**.
4. Update session times (FP1, Quali, Race, etc.).
5. **Format:** Check "Sprint Weekend" if applicable.
6. Tap **Save Schedule**.

> **Pro Tip:** Use the "Bulk Import JSON" button in the header to update the entire season schedule at once.

---

## 5. Drivers & Teams

Manage the entities available for selection.

1. Go to **Drivers & Teams** (Garage icon).
2. Toggle between **Drivers** and **Teams** tabs.
3. **Add New:** Tap **+ Add New** to create a replacement driver or new team.
4. **Edit:** Tap an existing row to change name, team association, or color.
5. **Retire:** Toggle the **Active** button to hide a driver/team from the player selection screen (history is preserved).

---

## 6. Scoring Configuration

Adjust how points are awarded.

1. Go to **Scoring Settings** (Trophy icon).
2. **Profiles:** You can create multiple scoring profiles (e.g., "2025 Rules", "Test System").
3. **Edit:** Select a profile to adjust points for GP finish, Sprint finish, Quali, and Fastest Lap.
4. **Activate:** Tap **Make Active** to apply that profile to the live leaderboard.

---

## ❓ Admin FAQ

**Q: The leaderboard didn't update after I saved results.**
A: Go to the main Admin Dashboard and tap the **Sync** button in the header. This forces a manual "Clean Sweep" recalculation of all scores.

**Q: A user created a duplicate account.**
A: Go to the **Database Manager** (top right icon on Dashboard), select the `users` collection, find the duplicate, and delete it. **Warning:** This is permanent.

**Q: Can I edit a user's picks for them?**
A: Yes. Go to **Manage Users**, select the user. You will see their profile as if you were them. You can make selections and submit on their behalf (e.g., if they emailed you picks due to a bug).

**Q: How do I handle a mid-season driver transfer?**
A: Go to **Drivers & Teams**. Edit the driver and change their **Team** dropdown selection. This updates their affiliation for future scoring calculation snapsots.

