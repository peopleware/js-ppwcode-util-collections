define(["dojo/main", "ppwcode/contracts/doh",
        "../StoreOfStateful", "dojo/store/Observable"],
  function(dojo, doh,
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
