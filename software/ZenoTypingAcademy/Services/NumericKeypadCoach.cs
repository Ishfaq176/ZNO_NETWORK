using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace ZenoTypingAcademy.Services;

public sealed class NumericKeypadCoach
{
    public Border Root { get; }
    private readonly Dictionary<string, Border> keys = new();
    private readonly TextBlock instruction;
    private readonly Brush normal = new SolidColorBrush(Color.FromRgb(27, 39, 68));
    private readonly Brush active = new SolidColorBrush(Color.FromRgb(33, 212, 167));

    public NumericKeypadCoach()
    {
        var outer = new StackPanel();
        instruction = new TextBlock
        {
            Text = "NUMPAD HOME: Index 4 • Middle 5 • Ring 6 • Pinky Enter",
            FontSize = 18,
            FontWeight = FontWeights.Bold,
            Foreground = Brushes.White,
            Margin = new Thickness(0, 0, 0, 12)
        };
        outer.Children.Add(instruction);

        var grid = new Grid { Width = 360, HorizontalAlignment = HorizontalAlignment.Left };
        for (int i = 0; i < 5; i++) grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(58) });
        for (int i = 0; i < 4; i++) grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(82) });

        Add(grid, "7", 0, 0); Add(grid, "8", 0, 1); Add(grid, "9", 0, 2); Add(grid, "/", 0, 3);
        Add(grid, "4", 1, 0); Add(grid, "5", 1, 1, "5 • HOME"); Add(grid, "6", 1, 2); Add(grid, "*", 1, 3);
        Add(grid, "1", 2, 0); Add(grid, "2", 2, 1); Add(grid, "3", 2, 2); Add(grid, "-", 2, 3);
        Add(grid, "0", 3, 0, columnSpan: 2); Add(grid, ".", 3, 2); Add(grid, "+", 3, 3);
        Add(grid, "ENTER", 4, 0, columnSpan: 4);
        outer.Children.Add(grid);

        outer.Children.Add(new TextBlock
        {
            Text = "Touch method: keep 4-5-6 under index-middle-ring. Find 5 by its raised bump without looking. Return to 4-5-6 after each reach.",
            Foreground = new SolidColorBrush(Color.FromRgb(155, 168, 199)),
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 12, 0, 0),
            FontSize = 14
        });

        Root = new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(10, 17, 33)),
            CornerRadius = new CornerRadius(16),
            Padding = new Thickness(18),
            Child = outer
        };
    }

    private void Add(Grid grid, string key, int row, int col, string? label = null, int columnSpan = 1)
    {
        var border = new Border
        {
            Background = normal,
            BorderBrush = new SolidColorBrush(Color.FromRgb(70, 86, 125)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(9),
            Margin = new Thickness(4),
            Child = new TextBlock
            {
                Text = label ?? key,
                Foreground = Brushes.White,
                FontWeight = FontWeights.Bold,
                FontSize = label != null ? 12 : 18,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            }
        };
        Grid.SetRow(border, row); Grid.SetColumn(border, col); Grid.SetColumnSpan(border, columnSpan);
        grid.Children.Add(border); keys[key] = border;
    }

    public void SetTarget(char c)
    {
        foreach (var k in keys.Values) k.Background = normal;
        string key = c switch { '\n' or '\r' => "ENTER", _ => c.ToString().ToUpperInvariant() };
        if (keys.TryGetValue(key, out var border)) border.Background = active;
        instruction.Text = $"NEXT: {(c == ' ' ? "SPACE" : key)}   →   {NumericTrainerService.FingerFor(c)}";
    }
}
