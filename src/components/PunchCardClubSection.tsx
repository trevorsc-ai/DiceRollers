interface ClubMember {
  rank: number;
  user: string;
  cardNumber: number;
  rolls: number;
  you: boolean;
}

const T = {
  surface:  "#1A1A1A",
  border:   "#252525",
  pink:     "#FF2D55",
  gold:     "#FFD600",
  text:     "#F5F5F5",
  textDim:  "#999999",
  textMute: "#555555",
} as const;

function rankColor(rank: number): string {
  if (rank === 1) return T.gold;
  if (rank === 2) return T.text;
  if (rank === 3) return T.pink;
  return T.textDim;
}

function RosterRow({ m }: { m: ClubMember }) {
  const c = rankColor(m.rank);
  const isYou = m.you;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "Space Mono, monospace",
        fontSize: 11,
        padding: isYou ? "5px 7px" : "2px 0",
        margin: isYou ? "-3px -7px" : 0,
        background: isYou
          ? `linear-gradient(90deg, ${T.pink}18, ${T.pink}05 70%, transparent)`
          : "transparent",
        border: isYou ? `1px solid ${T.pink}40` : "none",
        borderRadius: isYou ? 5 : 0,
      }}
    >
      {/* Rank */}
      <span
        style={{
          minWidth: 18,
          fontWeight: 700,
          color: m.rank <= 3 ? c : T.textMute,
          textShadow: m.rank === 1 ? "0 0 6px #FFD60080" : "none",
          letterSpacing: "0.04em",
        }}
      >
        {String(m.rank).padStart(2, "0")}
      </span>

      {/* Username + card number */}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontWeight: isYou ? 700 : 400,
          color: isYou ? T.pink : m.rank <= 3 ? c : T.text,
          textShadow: isYou ? "0 0 6px #FF2D5560" : "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        @{m.user}
        <span
          style={{
            color: isYou ? T.pink + "bb" : T.textMute,
            marginLeft: 6,
            fontSize: 9,
            letterSpacing: "0.14em",
            fontWeight: 400,
          }}
        >
          CARD #{m.cardNumber}
        </span>
        {isYou && (
          <span
            style={{
              color: T.textDim,
              marginLeft: 6,
              fontSize: 9,
              letterSpacing: "0.14em",
              fontWeight: 400,
            }}
          >
            YOU
          </span>
        )}
      </span>

      {/* Leader dots */}
      <span
        style={{
          flex: "0 0 38px",
          height: 1,
          alignSelf: "center",
          backgroundImage: `radial-gradient(circle, ${m.rank === 1 ? T.gold + "70" : T.border} 1px, transparent 1.2px)`,
          backgroundSize: "4px 1px",
          backgroundRepeat: "repeat-x",
        }}
      />

      {/* Rolls */}
      <span
        style={{
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: m.rank === 1 ? T.gold : isYou ? T.pink : T.text,
        }}
      >
        {m.rolls}
        <span
          style={{
            color: m.rank === 1 ? T.gold + "aa" : T.textDim,
            fontWeight: 400,
            marginLeft: 4,
            fontSize: 9,
            letterSpacing: "0.14em",
          }}
        >
          ROLLS
        </span>
      </span>
    </div>
  );
}

export function PunchCardClubSection({
  members,
  totalMembers,
  totalCompletions,
}: {
  members: ClubMember[];
  totalMembers: number;
  totalCompletions: number;
}) {
  if (members.length === 0) return null;

  const showing = members.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Section header */}
      <div
        style={{
          padding: "4px 2px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, lineHeight: "1" }}>🎟️</span>
          <span
            style={{
              fontFamily: "Space Mono, monospace",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.22em",
              color: T.text,
            }}
          >
            THE PUNCH CARD CLUB
          </span>
        </span>
        <span
          style={{
            fontFamily: "Space Mono, monospace",
            fontSize: 9,
            color: T.textDim,
            letterSpacing: "0.12em",
            fontWeight: 700,
            textAlign: "right",
          }}
        >
          {totalMembers} MEMBERS · {totalCompletions} COMPLETIONS
        </span>
      </div>

      <p
        style={{
          fontFamily: "Space Mono, monospace",
          fontSize: 9,
          letterSpacing: "0.18em",
          color: T.textMute,
          padding: "0 2px",
          margin: 0,
        }}
      >
        FASTEST TO PUNCH OUT
      </p>

      {/* Card */}
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: "12px 14px",
        }}
      >
        {/* Column header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "Space Mono, monospace",
            fontSize: 8,
            letterSpacing: "0.2em",
            color: T.textMute,
            fontWeight: 700,
            paddingBottom: 8,
            marginBottom: 8,
            borderBottom: `1px dashed ${T.border}`,
          }}
        >
          <span style={{ minWidth: 18 }}>#</span>
          <span style={{ flex: 1 }}>MEMBER</span>
          <span>ROLLS</span>
        </div>

        {/* Rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {members.map((m, i) => (
            <RosterRow key={i} m={m} />
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: `1px dashed ${T.border}`,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "Space Mono, monospace",
            fontSize: 9,
            letterSpacing: "0.16em",
            color: T.textMute,
          }}
        >
          <span>
            SHOWING 1–{showing} OF {totalCompletions}
          </span>
          <span style={{ color: T.pink, cursor: "pointer" }}>VIEW ALL ›</span>
        </div>
      </div>
    </div>
  );
}
