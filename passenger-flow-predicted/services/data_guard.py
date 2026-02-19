def has_enough_data(df, min_steps=32):
    if df.empty:
        return False
    return df['datetime'].nunique() >= min_steps
