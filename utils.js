function lerp(A, B, t) {
    return A + (B - A) * t;
}

function dist(A, B) {
    return Math.sqrt((A.x - B.x) ** 2 + (A.y - B.y) ** 2);
}