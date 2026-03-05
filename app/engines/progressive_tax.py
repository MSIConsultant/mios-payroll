# app/engines/progressive_tax.py

def calculate_progressive_tax(pkp: float) -> float:
    """
    Indonesian progressive tax based on latest UU HPP brackets.
    """

    tax = 0
    remaining = pkp

    brackets = [
        (60000000, 0.05),
        (250000000, 0.15),
        (500000000, 0.25),
        (5000000000, 0.30),
        (float("inf"), 0.35),
    ]

    for limit, rate in brackets:
        taxable = min(remaining, limit)
        tax += taxable * rate
        remaining -= taxable

        if remaining <= 0:
            break

    return tax