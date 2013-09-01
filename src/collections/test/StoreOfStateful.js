define(["ppwcode-util-contracts/doh",
        "../StoreOfStateful", "dojo/store/Observable"],
  function(doh,
           StoreOfStateful, Observable) {

    doh.register("StoreOfStateful", [

      function testConstructor() {
        var subject = new StoreOfStateful();
        doh.invars(subject);
      },

      function testConstructorWithObservable() {
        var subject = Observable(new StoreOfStateful());
        doh.invars(subject);
      }

    ]);

  }
);
