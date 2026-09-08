using System.Text;

namespace ZenoTypingAcademy.Services;

public static class NumericTrainerService
{
    public static string HomeRow => "456 654 445 566 456 654 465 546 455 664 456 654 564 645";
    public static string UpperRow => "789 987 778 899 789 987 798 879 788 997 789 987 897 978";
    public static string LowerRow => "123 321 112 233 123 321 132 213 122 331 123 321 231 312";
    public static string ZeroDecimal => "0 00 000 10.50 25.75 100.00 9.99 450.25 1200.50 0.75 88.80 905.05";
    public static string Operators => "125+75 900-245 48*6 720/9 1500+875 640-128 36*12 999/3 250+250 1000-375";
    public static string Accounting => "1250.00 7845.50 9632.75 4510.00 3200.25 9987.10 6501.80 2048.45 7777.70 4321.90 18500.00 972.35 44005.60 118.25 90210.00";
    public static string InvoiceEntry => "1001 1250.00 1002 875.50 1003 9400.75 1004 125.25 1005 18000.00 1006 725.80 1007 5620.40 1008 390.00 1009 11250.90 1010 84.35";

    public static string TimedPassage(int minimumCharacters = 9000)
    {
        string[] blocks = { Accounting, InvoiceEntry, Operators, ZeroDecimal, HomeRow, UpperRow, LowerRow };
        var sb = new StringBuilder(minimumCharacters + 500);
        int i = 0;
        while (sb.Length < minimumCharacters)
        {
            if (sb.Length > 0) sb.Append(' ');
            sb.Append(blocks[i++ % blocks.Length]);
        }
        return sb.ToString();
    }

    public static string FingerFor(char c) => c switch
    {
        '1' or '4' or '7' => "Right Index Finger",
        '2' or '5' or '8' => "Right Middle Finger",
        '3' or '6' or '9' or '.' => "Right Ring Finger",
        '+' or '-' or '*' or '/' or '\n' or '\r' => "Right Pinky Finger",
        '0' => "Right Thumb",
        ' ' => "Right Thumb / Space",
        _ => "Right Hand"
    };
}
