/**
 * Dòng nổi bật "Hạng của tôi / Tổng số người chơi".
 * Chỉ render khi đã biết username (parent quyết định) — chưa đăng nhập thì ẩn hẳn.
 */
export function MyRankBar({
  myRank,
  totalUsers,
}: {
  myRank: number | null;
  totalUsers: number | null;
}) {
  return (
    <div className="pixel-border-sm mt-6 flex flex-col gap-1.5 bg-[#f7c948] px-4 py-3 text-[#231b18] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p className="font-display text-base font-extrabold">
        My Rank:{" "}
        <span className="tabular-nums">
          {myRank === null ? "No rank yet" : `#${myRank}`}
        </span>
      </p>
      <p className="text-sm font-bold">
        Total players:{" "}
        <span className="tabular-nums">
          {totalUsers === null ? "—" : totalUsers.toLocaleString("en-US")}
        </span>
      </p>
    </div>
  );
}
