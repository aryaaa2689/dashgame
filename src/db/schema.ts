import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  trackId: text("track_id").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  maxPlayers: integer("max_players").notNull().default(8),
  status: text("status").notNull().default("lobby"), // lobby | racing | finished
  startAt: timestamp("start_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roomPlayers = pgTable(
  "room_players",
  {
    id: serial("id").primaryKey(),
    roomCode: text("room_code").notNull(),
    clientId: text("client_id").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#ffffff"),
    hat: text("hat").notNull().default("none"),
    isHost: boolean("is_host").notNull().default(false),
    ready: boolean("ready").notNull().default(false),
    // live race state
    dist: real("dist").notNull().default(0),
    lane: real("lane").notNull().default(0),
    hop: real("hop").notNull().default(0),
    speed: real("speed").notNull().default(0),
    finishTime: real("finish_time"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("room_players_room_idx").on(t.roomCode)],
);

export const leaderboard = pgTable("leaderboard", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#ffffff"),
  trackId: text("track_id").notNull(),
  timeMs: integer("time_ms").notNull(),
  placement: integer("placement").notNull(),
  mode: text("mode").notNull().default("bots"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
