import os
import sys
import statistics


try:
    import pymysql
except Exception:
    print("pymysql is not installed. Install it with: pip install pymysql", file=sys.stderr)
    sys.exit(1)


def compute_basic_stats(values):
    cleaned = [v for v in values if v is not None]
    if not cleaned:
        return {"mean": None, "median": None, "mode": None, "range": None}

    cleaned.sort()

    mean_val = float(sum(cleaned) / len(cleaned))
    median_val = float(statistics.median(cleaned))

    try:
        mode_candidates = statistics.multimode(cleaned)
        mode_val = float(mode_candidates[0]) if mode_candidates else None
    except Exception:
        try:
            mode_val = float(statistics.mode(cleaned))
        except Exception:
            mode_val = None

    range_val = float(cleaned[-1] - cleaned[0])

    return {"mean": mean_val, "median": median_val, "mode": mode_val, "range": range_val}


def fetch_from_db():
    """
    Connect to the same MySQL instance as backend/src/config/connectDB.js
    Defaults:
      host=localhost, port=3306, db=test, user=root, password=123456789a@
    Allow overriding via env: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
    """
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = int(os.getenv("DB_PORT", "3306"))
    db_name = os.getenv("DB_NAME", "test")
    db_user = os.getenv("DB_USER", "root")
    db_password = os.getenv("DB_PASSWORD", "123456789a@")

    conn = pymysql.connect(
        host=db_host,
        port=db_port,
        user=db_user,
        password=db_password,
        database=db_name,
        cursorclass=pymysql.cursors.DictCursor,
    )
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT revenue, rating FROM tourism_data;")
            rows = cur.fetchall()
            revenues = []
            ratings = []
            for r in rows:
                rev = r.get("revenue")
                rat = r.get("rating")
                revenues.append(float(rev) if rev is not None else None)
                ratings.append(float(rat) if rat is not None else None)
            return revenues, ratings
    finally:
        conn.close()


def main():
    print("Connecting to MySQL and reading from 'tourism_data'...")
    try:
        revenues, ratings = fetch_from_db()
    except Exception as e:
        print(f"Database read failed: {e}", file=sys.stderr)
        return 1

    rev_stats = compute_basic_stats(revenues)
    rat_stats = compute_basic_stats(ratings)

    print("")
    print("=== Tourism Data Statistics (source: database) ===")
    print("Revenue:")
    print(f"  mean  = {rev_stats['mean']}")
    print(f"  median= {rev_stats['median']}")
    print(f"  mode  = {rev_stats['mode']}")
    print(f"  range = {rev_stats['range']}")
    print("")
    print("Rating:")
    print(f"  mean  = {rat_stats['mean']}")
    print(f"  median= {rat_stats['median']}")
    print(f"  mode  = {rat_stats['mode']}")
    print(f"  range = {rat_stats['range']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
















